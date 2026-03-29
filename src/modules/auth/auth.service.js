import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../config/db.js';

const USERS_TABLE = 'auth.users';

export async function login(email, password) {
  const user = await db(USERS_TABLE).where({ email }).first();

  if (!user) {
    const err = new Error('Email sau parola incorecta.');
    err.statusCode = 401;
    err.code = 'CREDENTIALE_INVALIDE';
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Contul tau este dezactivat.');
    err.statusCode = 401;
    err.code = 'CONT_DEZACTIVAT';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Email sau parola incorecta.');
    err.statusCode = 401;
    err.code = 'CREDENTIALE_INVALIDE';
    throw err;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, fullName: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );

  return { token, user: sanitizeUser(user) };
}

export async function register({ email, password, fullName, role, badgeNumber, phone }) {
  const existing = await db(USERS_TABLE).where({ email }).first();
  if (existing) {
    const err = new Error('Exista deja un cont cu acest email.');
    err.statusCode = 409;
    err.code = 'EMAIL_DUPLICAT';
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await db(USERS_TABLE)
    .insert({
      email,
      password_hash,
      full_name: fullName,
      role,
      badge_number: badgeNumber || null,
      phone: phone || null,
    })
    .returning('*');

  return sanitizeUser(user);
}

export async function getMe(userId) {
  const user = await db(USERS_TABLE).where({ id: userId }).first();
  if (!user) {
    const err = new Error('Utilizatorul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'USER_NEGASIT';
    throw err;
  }
  return sanitizeUser(user);
}

export async function listUsers({ page = 1, limit = 20, role, isActive, search } = {}) {
  const offset = (page - 1) * limit;
  let query = db(USERS_TABLE);

  if (role) query = query.where({ role });
  if (isActive !== undefined) query = query.where({ is_active: isActive });
  if (search) {
    query = query.where((q) =>
      q.whereILike('full_name', `%${search}%`).orWhereILike('email', `%${search}%`)
    );
  }

  const [{ count }] = await query.clone().count('id as count');
  const users = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return {
    data: users.map(sanitizeUser),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

export async function updateUser(id, { fullName, role, badgeNumber, phone, isActive }) {
  const user = await db(USERS_TABLE).where({ id }).first();
  if (!user) {
    const err = new Error('Utilizatorul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'USER_NEGASIT';
    throw err;
  }

  const updates = {};
  if (fullName !== undefined) updates.full_name = fullName;
  if (role !== undefined) updates.role = role;
  if (badgeNumber !== undefined) updates.badge_number = badgeNumber;
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.is_active = isActive;
  updates.updated_at = new Date();

  const [updated] = await db(USERS_TABLE).where({ id }).update(updates).returning('*');
  return sanitizeUser(updated);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await db(USERS_TABLE).where({ id: userId }).first();

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    const err = new Error('Parola curenta este incorecta.');
    err.statusCode = 400;
    err.code = 'PAROLA_INCORECTA';
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db(USERS_TABLE).where({ id: userId }).update({ password_hash, updated_at: new Date() });
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}
