const API_BASE_URL = window.API_BASE_URL || '';

// Keep all DOM lookups in one place so the rest of the file can use clear names.
const elements = {
  loginPanel: document.getElementById('loginPanel'),
  adminDashboard: document.getElementById('adminDashboard'),
  loginForm: document.getElementById('loginForm'),
  adminPassword: document.getElementById('adminPassword'),
  loginMessage: document.getElementById('loginMessage'),
  logoutBtn: document.getElementById('logoutBtn'),
  filterDate: document.getElementById('filterDate'),
  bookingsTable: document.getElementById('bookingsTable'),
  totalBookings: document.getElementById('totalBookings'),
  todayBookings: document.getElementById('todayBookings'),
  totalRevenue: document.getElementById('totalRevenue')
};

let cachedBookings = [];

// Show only the login UI when there is no valid admin session.
function showLogin(message = '') {
  elements.adminDashboard.hidden = true;
  elements.loginPanel.hidden = false;
  elements.loginMessage.textContent = message;
  elements.adminPassword.focus();
}

// Show the protected dashboard after the backend accepts the admin session.
function showDashboard() {
  elements.loginPanel.hidden = true;
  elements.adminDashboard.hidden = false;
}

// Send the password to the backend; the backend sets the HttpOnly cookie on success.
async function login(event) {
  event.preventDefault();
  elements.loginMessage.textContent = 'Checking password...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: elements.adminPassword.value
      })
    });
    await readJsonResponse(response);

    elements.adminPassword.value = '';
    showDashboard();
    await loadBookings();
  } catch (err) {
    showLogin(err.message || 'Login failed.');
  }
}

// Ask the backend to expire the cookie, then clear dashboard state in the browser.
async function logout() {
  await fetch(`${API_BASE_URL}/api/admin/logout`, {
    method: 'POST'
  });
  cachedBookings = [];
  updateStats();
  renderTableMessage('Log in to view bookings.');
  showLogin('Logged out.');
}

// On page load, ask the backend whether the browser already has a valid session cookie.
async function checkSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/session`);
    const session = await readJsonResponse(response);

    if (session.authenticated) {
      showDashboard();
      await loadBookings();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin(err.message || 'Unable to check admin session.');
  }
}

async function loadBookings() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings`);
    const bookings = await readJsonResponse(response);

    cachedBookings = bookings;
    renderBookings();
    updateStats();
  } catch (err) {
    console.log(err);
    if (err.status === 401) {
      showLogin('Please log in to view bookings.');
    } else {
      renderTableMessage(err.message || 'Unable to load bookings.');
    }
  }
}

async function readJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }

  return data;
}

function trainingClass(trainingType) {
  if (trainingType === 'oncourt') return 'oncourt';
  if (trainingType === 'sand') return 'sand';
  return 'weight';
}

function renderTableMessage(message) {
  elements.bookingsTable.replaceChildren();

  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.textContent = message;
  cell.style.textAlign = 'center';
  row.appendChild(cell);
  elements.bookingsTable.appendChild(row);
}

// Use textContent instead of HTML strings so customer data is not treated as markup.
function createCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text || '';
  return cell;
}

function createTrainingCell(trainingType) {
  const cell = document.createElement('td');
  const tag = document.createElement('span');
  tag.className = `tag ${trainingClass(trainingType)}`;
  tag.textContent = trainingType || 'unknown';
  cell.appendChild(tag);
  return cell;
}

function createActionsCell(bookingId) {
  const cell = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'actions';

  const completeButton = document.createElement('button');
  completeButton.type = 'button';
  completeButton.className = 'complete-btn';
  completeButton.textContent = 'Done';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'cancel-btn';
  cancelButton.dataset.bookingId = bookingId;
  cancelButton.textContent = 'Cancel';

  actions.append(completeButton, cancelButton);
  cell.appendChild(actions);
  return cell;
}

function filteredBookings() {
  const selectedDate = elements.filterDate.value;

  if (!selectedDate) {
    return cachedBookings;
  }

  return cachedBookings.filter(booking => booking.date === selectedDate);
}

function renderBookings() {
  const bookingsToRender = filteredBookings();
  elements.bookingsTable.replaceChildren();

  if (bookingsToRender.length === 0) {
    renderTableMessage('No bookings found.');
    return;
  }

  bookingsToRender.forEach(booking => {
    const row = document.createElement('tr');
    row.append(
      createCell(booking.name),
      createCell(booking.date),
      createCell(booking.time_slot),
      createTrainingCell(booking.training_type),
      createActionsCell(String(booking.id))
    );
    elements.bookingsTable.appendChild(row);
  });
}

function updateStats() {
  elements.totalBookings.textContent = cachedBookings.length;

  const today = new Date().toISOString().split('T')[0];
  const todayCount = cachedBookings.filter(booking => booking.date === today).length;
  elements.todayBookings.textContent = todayCount;

  let revenue = 0;

  cachedBookings.forEach(booking => {
    if (typeof booking.amount_paid === 'number') {
      revenue += booking.amount_paid / 100;
    } else if (booking.training_type === 'oncourt') {
      revenue += 60;
    } else {
      revenue += 50;
    }
  });

  elements.totalRevenue.textContent = `$${revenue.toFixed(0)}`;
}

// Event listeners connect user actions to the small functions above.
elements.loginForm.addEventListener('submit', login);
elements.logoutBtn.addEventListener('click', logout);
elements.filterDate.addEventListener('change', renderBookings);

elements.bookingsTable.addEventListener('click', event => {
  if (!event.target.classList.contains('cancel-btn')) {
    return;
  }

  deleteBooking(event.target.dataset.bookingId);
});

checkSession();

async function deleteBooking(id) {
  const confirmed = confirm('Cancel this booking?');

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/${id}`, {
      method: 'DELETE'
    });
    await readJsonResponse(response);

    loadBookings();
  } catch (err) {
    console.log(err);
    renderTableMessage(err.message || 'Unable to cancel booking.');
  }
}