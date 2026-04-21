

const dateSelected = document.getElementById('datePicker').value;

const container = document.getElementById('timeSlots');

const AvailableTimes = ['7:00am','8:00am','9:00am'];

function renderTimes () {
  AvailableTimes.forEach(times => {
 const btn = document.createElement('button')
 btn.textContent = times
 btn.className = 'time-btn'

 container.append(btn)


})}; 

function dateSelect() {
  console.log(`day selected: ${dateSelected}`)
};