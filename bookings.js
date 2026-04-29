const container = document.getElementById('timeSlots');

async function renderTimes() {
  const dateSelected = document.getElementById('datePicker').value;

  // Make sure user picked a date
  if (!dateSelected) {
    alert("Please select a date first!");
    return;
  }

  container.innerHTML = "Loading..."; // clear old slots

  try {
    const response = await fetch(`http://localhost:3000/api/available-times?date=${dateSelected}`);
    const times = await response.json();

    container.innerHTML = ""; // clear loading text

    if (times.length === 0) {
      container.innerHTML = "<p>No available times for this date.</p>";
      return;
    }

    times.forEach(slot => {
      const btn = document.createElement('button');
      btn.textContent = slot.time_slot;
      btn.className = 'time-btn';

      // Highlight selected time
      btn.onclick = () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('selectedTime').value = slot.time_slot;
      };

      container.appendChild(btn);
    });

  } catch (err) {
    container.innerHTML = "<p>Error loading times. Is your server running?</p>";
    console.error(err);
  }
}