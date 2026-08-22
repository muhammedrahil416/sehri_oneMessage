const validateRegistration = (req, res, next) => {
    const {
      name,
      phone,
      password,
      gender,
      occupation,
      city,
      area,
      zone,
      address,
      otp
    } = req.body;
  
    if (!name || !phone || !password || !otp) {
      return res.status(400).json({
        message: "Name, phone, password and OTP are required"
      });
    }
  
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone number must be 10 digits"
      });
    }
  
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
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