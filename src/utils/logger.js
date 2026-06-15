const colors = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function formatTag(tag, color) {
  return `${color}[${tag}]${colors.reset}`;
}

function withTimestamp(message) {
  const ts = new Date().toISOString();
  return `${colors.gray}${ts}${colors.reset} ${message}`;
}

function info(message) {
  console.log(withTimestamp(`${formatTag("INFO", colors.blue)} ${message}`));
}

function success(message) {
  console.log(withTimestamp(`${formatTag("OK", colors.green)} ${message}`));
}

function warn(message) {
  console.warn(withTimestamp(`${formatTag("WARN", colors.yellow)} ${message}`));
}

function error(message) {
  console.error(withTimestamp(`${formatTag("ERROR", colors.red)} ${message}`));
}

module.exports = {
  info,
  success,
  warn,
  error,
};
