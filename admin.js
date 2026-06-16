const API_BASE_URL = window.API_BASE_URL || '';

const elements = {
  filterDate: document.getElementById('filterDate'),
  bookingsTable: document.getElementById('bookingsTable'),
  totalBookings: document.getElementById('totalBookings'),
  todayBookings: document.getElementById('todayBookings'),
  totalRevenue: document.getElementById('totalRevenue')
};

let cachedBookings = [];

function getAdminToken() {
  return window.ADMIN_API_TOKEN || window.localStorage.getItem('ADMIN_API_TOKEN') || '';
}

function adminHeaders() {
  const token = getAdminToken();
  return token ? { 'x-admin-token': token } : {};
}

async function loadBookings() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      headers: adminHeaders()
    });
    const bookings = await readJsonResponse(response);

    cachedBookings = bookings;
    renderBookings();
    updateStats();
  } catch (err) {
    console.log(err);
    renderTableMessage(err.message || 'Unable to load bookings.');
  }
}

async function readJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
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

elements.filterDate.addEventListener(
  'change',
  renderBookings
);

elements.bookingsTable.addEventListener('click', event => {
  if (!event.target.classList.contains('cancel-btn')) {
    return;
  }

  deleteBooking(event.target.dataset.bookingId);
});

loadBookings();

async function deleteBooking(id) {
  const confirmed = confirm('Cancel this booking?');

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    await readJsonResponse(response);

    loadBookings();
  } catch (err) {
    console.log(err);
    renderTableMessage(err.message || 'Unable to cancel booking.');
  }
}