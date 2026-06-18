const supabase = require('./supabase');

// Log an activity entry. Never throws — logging must not break the app.
async function logActivity(type, level, message, detail = null) {
  try {
    await supabase.from('biq_activity').insert({ type, level, message, detail });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

module.exports = { logActivity };
