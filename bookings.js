const API_BASE_URL = window.API_BASE_URL || '';

const elements = {
  timeSlots: document.getElementById('timeSlots'),
  selectedTime: document.getElementById('selectedTime'),
  datePicker: document.getElementById('datePicker'),
  viewTimesBtn: document.getElementById('viewTimesBtn'),
  bookBtn: document.getElementById('bookBtn'),
  name: document.getElementById('name'),
  email: document.getElementById('email'),
  phone: document.getElementById('phone'),
  trainingType: document.getElementById('trainingType'),
  message: document.getElementById('message')
};

const bookingState = {
  selectedTime: ''
};

const BOOKING_TIME_ZONE = 'America/New_York';

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

// The browser min date helps regular users avoid selecting old dates in Eastern Time.
function setMinimumBookingDate() {
  elements.datePicker.min = todayIsoDate();
}

function setMessage(message) {
  elements.message.textContent = message;
}

function getBookingForm() {
  return {
    name: elements.name.value.trim(),
    email: elements.email.value.trim(),
    phone: elements.phone.value.trim(),
    date: elements.datePicker.value,
    time: bookingState.selectedTime,
    trainingType: elements.trainingType.value
  };
}

function formatTimeSlot(timeSlot) {
  const [hourText, minute = '00'] = timeSlot.split(':');
  const hour = Number(hourText);

  if (Number.isNaN(hour)) {
    return timeSlot;
  }

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

// The frontend check gives a friendly message before making an API request.
function isPastDate(dateValue) {
  return dateValue < todayIsoDate();
}

async function readJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.code = data.code;
    throw error;
  }

  return data;
}

function selectedTimeExists(times, selectedTime) {
  return times.some(slot => slot.time_slot === selectedTime);
}

async function fetchAvailableTimes(dateValue) {
  const response = await fetch(
    `${API_BASE_URL}/api/available-times?date=${encodeURIComponent(dateValue)}`
  );
  return readJsonResponse(response);
}

// This refreshes the buttons with the backend's latest view of open slots.
async function refreshAvailableTimes(dateValue) {
  const times = await fetchAvailableTimes(dateValue);
  renderTimeSlots(times);
  return times;
}

function selectTimeSlot(button, timeSlot) {
  document
    .querySelectorAll('.time-btn')
    .forEach(currentButton => currentButton.classList.remove('selected'));

  button.classList.add('selected');
  bookingState.selectedTime = timeSlot;
  elements.selectedTime.value = timeSlot;
}

function renderTimeSlots(times) {
  elements.timeSlots.replaceChildren();
  bookingState.selectedTime = '';
  elements.selectedTime.value = '';

  if (times.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No available times for this date.';
    elements.timeSlots.appendChild(emptyMessage);
    return;
  }

  times.forEach(slot => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = formatTimeSlot(slot.time_slot);
    button.className = 'time-btn';
    button.addEventListener('click', () => selectTimeSlot(button, slot.time_slot));
    elements.timeSlots.appendChild(button);
  });
}

async function renderTimes() {
  const dateSelected = elements.datePicker.value;

  if (!dateSelected) {
    setMessage('Please select a date first.');
    return;
  }

  if (isPastDate(dateSelected)) {
    setMessage('Please select today or a future date.');
    elements.timeSlots.replaceChildren();
    return;
  }

  setMessage('');
  elements.timeSlots.textContent = 'Loading...';

  try {
    await refreshAvailableTimes(dateSelected);
  } catch (err) {
    elements.timeSlots.textContent = '';
    setMessage(err.message || 'Error loading times. Is your server running?');
    console.error(err);
  }
}

async function startCheckout() {
  const form = getBookingForm();

  if (!form.name || !form.email || !form.phone || !form.date || !form.time) {
    setMessage('Please complete all fields and select a time.');
    return;
  }

  if (isPastDate(form.date)) {
    setMessage('Please select today or a future date.');
    return;
  }

  setMessage('');
  elements.bookBtn.disabled = true;
  elements.bookBtn.textContent = 'Starting checkout...';

  try {
    // Re-check availability right before Stripe so users get a clear message
    // if another customer took the slot while this page was sitting open.
    const latestTimes = await fetchAvailableTimes(form.date);

    if (!selectedTimeExists(latestTimes, form.time)) {
      renderTimeSlots(latestTimes);
      setMessage('That time was just booked. Please choose another available time.');
      elements.bookBtn.disabled = false;
      elements.bookBtn.textContent = 'Book Now';
      return;
    }

    const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form)
    });
    const data = await readJsonResponse(response);

    window.location.href = data.url;
  } catch (err) {
    if (err.message === 'This time slot is already booked.' || err.code === 'SLOT_TAKEN') {
      try {
        await refreshAvailableTimes(form.date);
      } catch (refreshErr) {
        console.error(refreshErr);
      }
      setMessage('That time was just booked. Please choose another available time.');
    } else {
      setMessage(err.message || 'Payment session failed.');
    }
    console.error(err);
    elements.bookBtn.disabled = false;
    elements.bookBtn.textContent = 'Book Now';
  }
}

elements.viewTimesBtn.addEventListener('click', renderTimes);
elements.bookBtn.addEventListener('click', startCheckout);
setMinimumBookingDate();