import db from '../../config/db.js';

// ─── Companies ────────────────────────────────────────────────────────────────

export async function listCompanies({ page = 1, limit = 50, companyType, active, search } = {}) {
  const offset = (page - 1) * limit;
  let q = db('companies.companies').orderBy('name');
  if (companyType) q = q.where('company_type', companyType);
  if (active !== undefined) q = q.where('is_active', active === 'true' || active === true);
  if (search) q = q.where('name', 'ilike', `%${search}%`);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function getCompany(id) {
  const company = await db('companies.companies').where({ id }).first();
  if (!company) return null;
  const contacts = await db('companies.contacts').where({ company_id: id }).orderBy('is_primary', 'desc');
  return { ...company, contacts };
}

export async function createCompany(data) {
  const [company] = await db('companies.companies').insert({
    name: data.name,
    company_type: data.companyType,
    fiscal_code: data.fiscalCode,
    trade_register: data.tradeRegister,
    address: data.address,
    city: data.city,
    country: data.country || 'Romania',
    phone: data.phone,
    email: data.email,
    website: data.website,
    payment_terms_days: data.paymentTermsDays ?? 30,
    notes: data.notes,
    is_active: data.isActive !== false,
  }).returning('*');
  return company;
}

export async function updateCompany(id, data) {
  const row = {};
  const map = {
    name: 'name', companyType: 'company_type', fiscalCode: 'fiscal_code',
    tradeRegister: 'trade_register', address: 'address', city: 'city',
    country: 'country', phone: 'phone', email: 'email', website: 'website',
    paymentTermsDays: 'payment_terms_days', notes: 'notes', isActive: 'is_active',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  row.updated_at = new Date();
  const [company] = await db('companies.companies').where({ id }).update(row).returning('*');
  return company;
}

export async function softDeleteCompany(id) {
  const [company] = await db('companies.companies').where({ id }).update({ is_active: false, updated_at: new Date() }).returning('*');
  return company;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(companyId) {
  return db('companies.contacts').where({ company_id: companyId }).orderBy('is_primary', 'desc');
}

export async function createContact(companyId, data) {
  const [contact] = await db('companies.contacts').insert({
    company_id: companyId,
    full_name: data.fullName,
    role: data.role,
    phone: data.phone,
    email: data.email,
    is_primary: data.isPrimary || false,
    notes: data.notes,
  }).returning('*');
  return contact;
}

export async function updateContact(id, data) {
  const row = {};
  if (data.fullName !== undefined) row.full_name = data.fullName;
  if (data.role !== undefined) row.role = data.role;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email;
  if (data.isPrimary !== undefined) row.is_primary = data.isPrimary;
  if (data.notes !== undefined) row.notes = data.notes;
  const [contact] = await db('companies.contacts').where({ id }).update(row).returning('*');
  return contact;
}

export async function deleteContact(id) {
  return db('companies.contacts').where({ id }).delete();
}
