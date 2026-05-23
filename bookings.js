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

// This block of code is getting values of input fields and posting them after user clicks book now

document.getElementById('bookBtn')
.addEventListener('click', async () => {

  const name =
    document.getElementById('name').value;

  const email =
    document.getElementById('email').value;

  const phone =
    document.getElementById('phone').value;

  const date =
    document.getElementById('datePicker').value;

  const time =
    document.getElementById('selectedTime').value;

  const trainingType =
    document.getElementById('trainingType').value;

  if (
    !name ||
    !email ||
    !phone ||
    !date ||
    !time
  ) {

    alert("Please complete all fields.");

    return;

  }

  try {

    const response = await fetch(
      'http://localhost:3000/create-checkout-session',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          name,
          email,
          phone,
          date,
          time,
          trainingType
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      alert(data.error);

      return;

    }

    // Redirect to Stripe Checkout
    window.location.href = data.url;

  } catch (err) {

    console.error(err);

    alert("Payment session failed.");

  }

});