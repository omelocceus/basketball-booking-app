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

async function readJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
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

  setMessage('');
  elements.timeSlots.textContent = 'Loading...';

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/available-times?date=${encodeURIComponent(dateSelected)}`
    );
    const times = await readJsonResponse(response);
    renderTimeSlots(times);
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

  setMessage('');
  elements.bookBtn.disabled = true;
  elements.bookBtn.textContent = 'Starting checkout...';

  try {
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
    setMessage(err.message || 'Payment session failed.');
    console.error(err);
    elements.bookBtn.disabled = false;
    elements.bookBtn.textContent = 'Book Now';
  }
}

elements.viewTimesBtn.addEventListener('click', renderTimes);
elements.bookBtn.addEventListener('click', startCheckout);