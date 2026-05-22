const container = document.getElementById('timeSlots');
// this function is rendering the times available 

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

// This block of code is getting values of input fields and posting them after on click 

document.getElementById('bookBtn').addEventListener('click', async () => {

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const date = document.getElementById('datePicker').value;
  const time = document.getElementById('selectedTime').value;

  if (!name || !email || !date || !time) {
    alert("Please complete all fields.");
    return;
  }

  try {

    const response = await fetch('http://localhost:3000/api/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        date,
        time
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error);
      return;
    }

    alert("Booking successful!");

    // Redirect to payment page
    window.location.href = "payment.html";

  } catch (err) {
    console.error(err);
    alert("Booking failed.");
  }

});