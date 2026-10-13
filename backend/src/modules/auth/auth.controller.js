import User from '../users/user.model.js';
import ApiError from '../../utils/ApiError.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Account from '../accounts/account.model.js';

export const register = async (req, res, next) => {
  let session;

  try {
    session = await User.startSession();

    const { name, email, password } = req.body;

    let user;

    await session.withTransaction(async () => {
      const existingUser = await User.findOne({ email }).session(session);

      if (existingUser) {
        throw new ApiError(
          409,
          'An account with this email already exists'
        );
      }

      [user] = await User.create(
        [
          {
            name,
            email,
            password,
          },
        ],
        { session }
      );

      await Account.create(
        [
          {
            userId: user._id,
          },
        ],
        { session }
      );
    });

    // Generate a JWT after the transaction succeeds.
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Automatically authenticate the newly registered user.
    res.cookie('tark_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new ApiError(409, 'An account with this email already exists')
      );
    }

    next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('tark_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};



export const logout = (req, res) => {
  res.clearCookie('tark_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
};



export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};