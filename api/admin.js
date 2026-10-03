// api/admin.js
import manageAdmin from '../server/manageAdmin.js';
import moderateUser from '../server/moderateUser.js';
import homeHubTabs from '../server/manageHomeHubTabs.js';

const actions = {
  'manage-admin': manageAdmin,
  'moderate-user': moderateUser,
  'manage-home-hub-tabs': homeHubTabs,
};

export default async function handler(req, res) {
  const fn = actions[req.query.action];
  if (!fn) return res.status(404).json({ error: 'Unknown action' });
  return fn(req, res);
}