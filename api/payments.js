import processBillPayment from '../server/processBillPayment.js';
import processRecharge from '../server/processRecharge.js';

const actions = {
  'process-bill-payment': processBillPayment,
  'process-recharge': processRecharge,
};

export default async function handler(req, res) {
  const fn = actions[req.query.action];
  if (!fn) return res.status(404).json({ error: 'Unknown action' });
  return fn(req, res);
}