const service = require("./reservations.service");
const asyncErrorBoundary = require("../errors/asyncErrorBoundary");
const hasProperties = require("../errors/hasProperties");

const VALID_PROPERTIES = [
  "first_name",
  "last_name",
  "mobile_number",
  "reservation_date",
  "reservation_time",
  "people"
]
//The above properties cannot be empty or ===""
const hasRequiredProperties = hasProperties(...VALID_PROPERTIES);

//validates that the people input is a number and greater than 0
function validatePeople(req, res, next){
  const {people} = req.body.data;
  if(!people || people < 1 || typeof people !== "number"){
    return next({
      status: 400,
      message: `number of people is invalid`
    });
  };
  next();
}

// validates the following:
//   reservation date and time is formatted currectly
//   The reservation date and time is for a future day/time
//   the reservation date is not a tuesday (closed)
//   the reservation time is during buisness hours
function validateDateAndTime(req, res, next) {
  const { reservation_date, reservation_time } = req.body.data;
  const reservationDate = new Date(`${reservation_date}T${reservation_time}:00.000`);
  const todaysDate = new Date();
  const reservationTime = Number(reservation_time.replace(":", ""));

  if (!reservation_date.match(/\d{4}-\d{2}-\d{2}/)) {
    return next({ status: 400, message: 'reservation_date is invalid!' });
  };

  if (reservationDate < todaysDate) {
    return next({status: 400, message: "Requested reservation is in the future"})
  };

  if (reservationDate.getDay() === 2) {
    return next({status: 400, message: "Restaurant is closed on Tuesdays"})
  };
  
  if (!reservation_time.match(/\d{2}:\d{2}/)) {
    return next({ status: 400, message: 'reservation_time is invalid!' });
  };
  
  if (reservationTime < 1030 || reservationTime > 2130) {
    return next({ status: 400, message: 'Restaurant is closed during requested reservation time.'})
  };
  
  next();
}

//validates that the reservation being created is not already seated or finished
function validateNewResStatus(req, res, next) {
  const { status } = req.body.data;
  if (status === "seated" || status === "finished") {
    return next({ status: 400, message: `status can't be seated or finished`})
  }
  next();
}

//checks that the reservation exists with the reservation_id
async function reservationExists(req, res, next) {
  const { reservation_id } = req.params;
  const reservation = await service.read(reservation_id);
  if (!reservation) {
    return next({ status: 404, message: `Reservation ${reservation_id} cannot be found` });
  }
  
  res.locals.reservation = reservation;
  next();
}

async function validateStatus(req, res, next) {
  const currentStatus = res.locals.reservation.status;
  const { status } = req.body.data;

  if (status === "cancelled") return next();
  
  if (currentStatus === "finished") {
    return next({ status: 400, message: "A finished reservation cannot be updated." });
  };

  if (status !== "booked" && status !== "seated" && status !== "finished") {
    return next({ status: 400, message: "unknown status." });
  };

  next();
};

/**
 * List handler for reservation resources
 */
async function list(req, res, next) {
  const { date, mobile_number } = req.query;
  
  if (date) {
    return res.json({ data: await service.list(date) });
  } else if (mobile_number) {
    return res.json({ data: await service.search(mobile_number) });
  }
}

/**
 * create handler for a new reservation
 */
async function create(req, res) {
  const newReservation = req.body.data
  res.status(201).json({data: await service.create(newReservation)})
}

/**
 * Read handler for target reservation_id
 */
function read(req, res) {
  res.json({data: res.locals.reservation})
}

/**
 * update handler for reservation status (only)
 */
async function updateStatus(req, res, next) {
  const { reservation_id } = req.params;
  const { status } = req.body.data;
  const reservation = await service.updateStatus(reservation_id, status);

  res.status(200).json({ data: { status: reservation[0] }});
};

/**
 * Update handler for reservation 
 */
async function updateReservation(req, res, next) {
  const { reservation_id } = req.params;
  if (reservation_id) {
    res.json({
      data: await service.update(reservation_id, req.body.data),
    });
  }else{
    next({
      status: 404,
      message: "no reservation_id found"
    })
  }
}

module.exports = {
  list: asyncErrorBoundary(list),
  read: [asyncErrorBoundary(reservationExists), read],
  create: [
    asyncErrorBoundary(hasRequiredProperties),
    asyncErrorBoundary(validatePeople),
    asyncErrorBoundary(validateDateAndTime),
    asyncErrorBoundary(validateNewResStatus),
    asyncErrorBoundary(create),
  ],
  updateStatus: [
    asyncErrorBoundary(reservationExists),
    asyncErrorBoundary(validateStatus),
    asyncErrorBoundary(updateStatus)
  ],
  update: [
    asyncErrorBoundary(reservationExists),
    asyncErrorBoundary(hasRequiredProperties),
    asyncErrorBoundary(validatePeople),
    asyncErrorBoundary(validateDateAndTime),
    asyncErrorBoundary(updateReservation),
  ]
};
