'use strict';

// Components
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const alertContainer = document.querySelector('.alert-container');
const eraseBtn = document.querySelector('.erase-record-btn');

class Workout {
  date = new Date();
  id = 'id' + Math.random().toString(16).slice(2);

  // Common inputs from both types of workouts
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, long]
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    this.description = `${
      this.type === 'running' ? '🏃' : '🚴‍♀️'
    } ${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}
class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance; // min/km
    return this.pace; // For chaining
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration * 60); // km/h
    return this.speed;
  }
}

// Classes
class App {
  #map;
  #mapZoomLevel = 15;
  #mapE;
  #workouts = [];
  #markers = [];

  constructor() {
    // Display help message
    this._displayAlert('Click on the map to add a marker!', 3000);

    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Event listener always has the `this` as the element it is attached to
    form.addEventListener('submit', this._newWorkout.bind(this));

    // Change between Elevation and Cadence fields for running/cycling
    inputType.addEventListener('change', this._toggleElevationField.bind(this));

    // Event listener for
    containerWorkouts.addEventListener('click', this._moveToMarker.bind(this));
    containerWorkouts.addEventListener(
      'contextmenu',
      this._handleRemove.bind(this)
    );

    // Erase btn
    this._checkDisplayEraseBtn();
    eraseBtn.addEventListener('click', this._handleRemoveAll.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      // Since getCurrentPosition is calling ._loadMap, this is bound to the function itself. We need to bind it correctly
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function (error) {
          console.log(error);
        }
      );
  }

  _loadMap(position) {
    // Get coords
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    // Create Google Maps URL
    const gglmap_url = `https://www.google.com/maps/@${latitude},${longitude}`;
    // Create leaflet map:
    //// .map(*elm_id* ).setView(*coords*, *zoom*)
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    //// Map is made up of tiles
    //// openstreetmap is an open-source map. We can change its style. .fr/hot looks really nice
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //// Marker.
    //// Add event listener to `map`, since a normal event listener would not give us the coords.
    //// Show Form
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => this._renderWorkOutMarker(workout));
  }

  _showForm(mapEvent) {
    this.#mapE = mapEvent;
    // Display form on click-on-map
    form.classList.remove('hidden');
    inputDistance.focus(); // Focus on input immediately
    // Then 'submit' event behvavior is triggered
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validateInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    const allPositive = (...inputs) => inputs.every(input => input > 0);

    e.preventDefault();
    // Get data from form and validate
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapE.latlng;
    const coords = [lat, lng];
    let workoutObj;

    // Create new object according to type.
    //// Running
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Validate
      if (
        !validateInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._displayAlert('Input must be positive numbers');
        return;
      }
      // Add new object to workout array
      workoutObj = new Running(coords, distance, duration, cadence);
      this.#workouts.push(workoutObj);
      console.log(workoutObj);
    }
    //// Cycling
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Validate
      if (
        !validateInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._displayAlert('Input must be positive numbers');
        return;
      }

      // Add new object to workout array
      workoutObj = new Cycling(coords, distance, duration, elevation);
      this.#workouts.push(workoutObj);
      console.log(workoutObj);
    }

    // Render workout marker
    this._renderWorkOutMarker(workoutObj);

    // Render workout list
    this._renderWorkOutOnList(workoutObj);

    // Hide form
    this._hideForm();

    // Update local storage
    this._setLocalStorage();

    // Display erase button
    this._checkDisplayEraseBtn();
  }

  _hideForm() {
    // Empty input fields
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';

    const last_display = form.style.display;
    form.style.display = 'none';
    form.classList.add('hidden'); // This creates an animation, therefore we need the line above
    setTimeout(() => (form.style.display = last_display)); // Adds back the display immediately.
  }

  _renderWorkOutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 50,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.description}`)
      .openPopup();
    this.#markers.push(marker);
  }

  _renderWorkOutOnList(workout) {
    let newHtml = `
    <li class="workout workout--${workout.type}" data-id=${workout.id}>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
      </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;

    if (workout.type === 'running')
      newHtml += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;

    if (workout.type === 'cycling')
      newHtml += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    form.insertAdjacentHTML('afterend', newHtml);
  }

  _moveToMarker(e) {
    const workoutEl = e.target.closest('.workout'); // Regardless of where the click happens, target the workout element
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    // Restore objects as Workout objects
    const restoredWorkouts = [];
    data.forEach(workout => {
      let restoredWorkout;
      if (workout.type === 'running') {
        restoredWorkout = new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence
        );
      } else {
        restoredWorkout = new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain
        );
      }
      restoredWorkouts.push(restoredWorkout);
    });
    this.#workouts = restoredWorkouts;
    // this.#workouts = data;

    this.#workouts.forEach(workout => {
      this._renderWorkOutOnList(workout);
    });
  }

  _handleRemove(e) {
    e.preventDefault();
    const workout = e.target.closest('.workout');
    if (!workout) return;

    // Remove HTML
    const element = document.querySelector(`[data-id="${workout.dataset.id}"]`);
    let coords;
    element.remove();

    // Remove from array
    this.#workouts = this.#workouts.filter(item => {
      if (item.id != workout.dataset.id) {
        return true;
      } else {
        coords = { lat: item.coords[0], lng: item.coords[1] };
        return false;
      }
    });

    // Remove marker from map
    this.#markers = this.#markers.filter(marker => {
      if (
        marker._latlng.lat != coords.lat &&
        marker._latlng.lng != coords.lng
      ) {
        return true;
      } else {
        this.#map.removeLayer(marker);
        return false;
      }
    });

    // Set localStorage
    this._setLocalStorage();

    // Check display erase button
    this._checkDisplayEraseBtn();
  }

  _handleRemoveAll() {
    // Remove HTML
    const element = document.querySelectorAll(`[data-id]`);
    element.forEach(elm => elm.remove());
    // Reset array
    this.#workouts = [];
    // Remove markers
    this.#markers.forEach(marker => this.#map.removeLayer(marker));
    this.#markers = [];
    // Set localStorage
    this._setLocalStorage();
    // Check display erase button
    console.log(this.#workouts);
    this._checkDisplayEraseBtn();
  }

  // Create & display fading alert for error message
  _createAlert(message, duration = 1000) {
    const alert = document.createElement('div');
    alert.textContent = message;
    alert.classList.add('alert');
    alertContainer.append(alert);
    setTimeout(() => {
      alert.classList.add('hide');
      alert.addEventListener('transitionend', () => alert.remove()); // Delete old alerts at the end of transition
    }, duration);
  }

  _displayAlert(message, duration = 1000) {
    const alert = alertContainer.querySelector('.alert');

    // Checks for existing alert. If yes, destroy immediately then setTimeout again
    if (alert === null) {
      this._createAlert(message, duration);
    } else {
      alert.remove();
      this._createAlert(message, duration);
    }
  }

  _checkDisplayEraseBtn() {
    if (this.#workouts.length === 0) {
      eraseBtn.classList.add('hide');
    } else {
      eraseBtn.classList.remove('hide');
    }
  }

  // Unused
  _reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

/*
ADDITONAL FEATURES TO BE IMPLEMENTED:
// Easy 
2. Delete a workout - Done! 
3. Delete all workouts - Done!
4. Sort workouts by certain field
5. Realistic error message - Done!

// Harder
6. Show all workout markers
7. Draw lines and shapes
8. Geocode Location from coordinates
9. Display weather for workout time and place
*/
