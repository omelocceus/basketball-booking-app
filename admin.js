const container =
  document.getElementById(
    'bookingsContainer'
  );

const filterDate =
  document.getElementById(
    'filterDate'
  );

async function loadBookings() {

  try {

    const response =
      await fetch(
        'http://localhost:3000/api/bookings'
      );

    const bookings =
      await response.json();

    renderBookings(bookings);

    updateStats(bookings);

  } catch (err) {

    console.log(err);

  }

}

function renderBookings(bookings) {

  const table =
    document.getElementById(
      'bookingsTable'
    );

  table.innerHTML = '';

  const selectedDate =
    filterDate.value;

  let filteredBookings =
    bookings;

  if (selectedDate) {

    filteredBookings =
      bookings.filter(
        booking =>
          booking.date === selectedDate
      );

  }

  filteredBookings.forEach(
    booking => {

      let tagClass = '';

      if (
        booking.training_type ===
        'oncourt'
      ) {

        tagClass = 'oncourt';

      } else if (
        booking.training_type ===
        'sand'
      ) {

        tagClass = 'sand';

      } else {

        tagClass = 'weight';

      }

      const row =
        document.createElement('tr');

      row.innerHTML = `

        <td>${booking.name}</td>

        <td>${booking.date}</td>

        <td>${booking.time_slot}</td>

        <td>
          <span class="tag ${tagClass}">
            ${booking.training_type}
          </span>
        </td>

        <td>

          <div class="actions">

            <button
              class="complete-btn"
            >
              Done
            </button>

            <button
              class="cancel-btn"
              onclick="deleteBooking(${booking.id})"
            >
              Cancel
            </button>

          </div>

        </td>

      `;

      table.appendChild(row);

    }
  );

}

function updateStats(bookings) {

  document.getElementById(
    'totalBookings'
  ).textContent =
    bookings.length;

  const today =
    new Date()
      .toISOString()
      .split('T')[0];

  const todayCount =
    bookings.filter(
      booking =>
        booking.date === today
    ).length;

  document.getElementById(
    'todayBookings'
  ).textContent =
    todayCount;

  let revenue = 0;

  bookings.forEach(booking => {

    if (
      booking.training_type ===
      'oncourt'
    ) {

      revenue += 60;

    } else {

      revenue += 50;

    }

  });

  document.getElementById(
    'totalRevenue'
  ).textContent =
    `$${revenue}`;

}

filterDate.addEventListener(
  'change',
  loadBookings
);

loadBookings();

async function deleteBooking(id) {

  const confirmed =
    confirm(
      'Cancel this booking?'
    );

  if (!confirmed) return;

  try {

    await fetch(
      `http://localhost:3000/api/bookings/${id}`,
      {
        method: 'DELETE'
      }
    );

    loadBookings();

  } catch (err) {

    console.log(err);

  }

}