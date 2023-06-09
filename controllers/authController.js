// Dependencies
const AppError = require('./../utils/appError');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const sendEmail = require('./../utils/email');
// Model
const User = require('./../models/userModel');
const { sign } = require('crypto');
// Function to create jwt
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};
// Function to create token and send through header
const createAndSendToken = (user, statusCode, req, res) => {
    const token = signToken(user._id);
    // Send cookie
    res.cookie('jwt', token, {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 1000),
        httpOnly: true,
        secure: false
    });
    // Remove password from output
    user.password = undefined;
    res.status(statusCode).json({
        status: 'success',
        token,
        data: user
    })
};
// sign up user
exports.signUp = async(req, res, next) => {
    try {
        // Create upser from input
        const user = await User.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            passwordConfirm: req.body.passwordConfirm,
            passwordChangedAt: req.body.passwordChangedAt,
            role: req.body.role
        });
        createAndSendToken(user, 201, req, res);
    } catch(err) {
        res.status(400).json({
            status: 'fail',
            message: err
        });
    }
};
// Login user
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // Check if email and password exist
        if(!email || !password) {
            return next(new AppError('Please provide email and password', 400));
        }
        // Check if user exists and password is correct
        const user = await User.findOne({ email }).select('+password');
        if(!user || !(await user.correctPassword(password, user.password))) {
            return next(new AppError('Incorrect email or password', 401));
        };
        // If everything is ok, send token to client
        createAndSendToken(user, 200, req, res);

    } catch(err) {
        res.status(400).json({
            status: 'fail',
            message: err
        });
    }
};
// Protect routes
exports.protect = async(req, res, next) => {
    try {
        // Check if token exsits in headers
        let token;
        if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        };
        // If no token throw error
        if(!token) {
            return next(new AppError('You are not logged in! Please log in to get access', 401));
        };
        // Verify token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        // Check if user still exsits
        const currentUser = await User.findById(decoded.id);
        if(!currentUser) {
            return next(new AppError('The user belonging to this token does no longer exsit.', 401));
        };
        // Check if user changed password after token was issued
        if(currentUser.passwordChangedAfter(decoded.iat)) {
            return next(new AppError('User recently changed password! Please log in again.', 401));
        }
        // Grant access to protected route
        req.user = currentUser;
        next();
    } catch(err) {
        res.status(401).json({
            status: 'fail',
            message: err
        });
    }
};
// Restric access to certain users
exports.restrictTo = (...roles) => {
    // Returning function to use req, res params
    return (req, res, next) => {
        // Check if user role is in role array provided
        if(!roles.includes(req.user.role)) {
            // If user does not have role to perform action throw error
            return next(new AppError('you do not have permission to perform this action', 403));
        };
        // If user has role to perform action continue
        next();
    };
};
// Password reset controllers
exports.forgotPassword = async(req, res, next) => {
    // Get user from db using email provided
    const user = await User.findOne({ email: req.body.email });
    // If no user
    if(!user) {
        // If no user throw error
        return next(new AppError('There is no user with that email address.', 404));
    }
    console.log(user);
    // Generate random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    // Send email
    // Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    // Reset password message
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetUrl}.\nIf you didn't forget your password, please ignore this email!`;
    try {
        console.log('sending email');
        await sendEmail({
            email: user.email,
            subject: 'Your password reset token (valid for 10 min)',
            message
        });
        console.log('email sent');
        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch(err) {
        console.log(`error==========`, user)
        // Reset user password reset fields if email does not send
        console.log(`reseting user fields`);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        // Save email with new changes
        console.log(`saving new user fields`);
        await user.save({ validateBeforeSave: false });
        return next(new AppError('There was an error sending the email. Please try again later!'), 500);
    }
}; 
exports.resetPassword = async(req, res, next) => {
    // Get user based on token
    // Hash token from params
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    // Compare hashed token from params to user in db
    const user = await User.findOne({passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() }});
    if(!user) {
        return next(new AppError('Token is invalid or has expired', 400)) ;
    } else {
        console.log('user found')
    }
    // If token is valid and user exist, set new password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    // Update changedPasswordAt field for the user
    // Log the user in and send jwt
    createAndSendToken(user, 201, req, res);
};
exports.updatePassword = async(req, res, next) => {
    try {
        // Get user from db
        const user = await User.findById(req.user.id).select('+password');
        // Check if current user password is correct
        if(!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
            // Return error
            return next(new AppError('Your current password is wrong.', 401));
        };
        // If passwords match update new password
        user.password = req.body.password;
        user.passwordConfirm = req.body.passwordConfirm;
        // Use save to re-run validators
        await user.save();
        // Assign jwt
        createAndSendToken(user, 200, req, res);
    } catch(err) {
        res.status(400).json({
            status: 'fail',
            message: err
        })
    }
};