const validateRegistration = (req, res, next) => {
  const {
    name,
    phone,
    password,
    gender,
    occupation,
    location_id,
    address,
    otp
  } = req.body;

  if (
    !name ||
    !phone ||
    !password ||
    !gender ||
    !occupation ||
    !location_id ||
    !address ||
    !otp
  ) {
    return res.status(400).json({
      message:
        "Name, phone, password, gender, occupation, location_id, address and OTP are required"
    });
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      message: "Phone number must be a valid 10-digit Indian mobile number"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters"
    });
  }

  if (!["male", "female"].includes(gender)) {
    return res.status(400).json({
      message: "Gender must be male or female"
    });
  }

  if (!["student", "employee", "others"].includes(occupation)) {
    return res.status(400).json({
      message: "Invalid occupation"
    });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      message: "OTP must be 6 digits"
    });
  }

  next();
};

module.exports = validateRegistration;