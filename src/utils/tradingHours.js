const config = require('../config');
const logger = require('./logger');

const isTradingDay = () => {
  const now = new Date();
  const offset = 6 * 60 * 60 * 1000;
  const bangladeshNow = new Date(now.getTime() + offset);
  const day = bangladeshNow.getUTCDay();
  
  return config.trading.days.includes(day);
};

const isTradingHours = () => {
  const now = new Date();
  const offset = 6 * 60 * 60 * 1000;
  const bangladeshNow = new Date(now.getTime() + offset);
  const hours = bangladeshNow.getUTCHours();
  const minutes = bangladeshNow.getUTCMinutes();
  
  const currentMinutes = hours * 60 + minutes;
  const startMinutes = config.trading.startHour * 60 + config.trading.startMinute;
  const endMinutes = config.trading.endHour * 60 + config.trading.endMinute;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

const isTradingOpen = () => {
  return isTradingDay() && isTradingHours();
};

const getBangladeshTime = () => {
  const now = new Date();
  const offset = 6 * 60 * 60 * 1000;
  return new Date(now.getTime() + offset);
};

const getBangladeshDate = () => {
  const now = new Date();
  const offset = 6 * 60 * 60 * 1000;
  const bangladeshNow = new Date(now.getTime() + offset);
  const year = bangladeshNow.getUTCFullYear();
  const month = bangladeshNow.getUTCMonth();
  const day = bangladeshNow.getUTCDate();
  return new Date(Date.UTC(year, month, day));
};

const getNextTradingTime = () => {
  const now = new Date();
  const offset = 6 * 60 * 60 * 1000;
  const bangladeshNow = new Date(now.getTime() + offset);
  
  let next = new Date(bangladeshNow);
  const currentHour = bangladeshNow.getUTCHours();
  next.setUTCHours(config.trading.startHour, config.trading.startMinute, 0, 0);
  
  if (!isTradingDay() || currentHour > config.trading.startHour) {
    next.setUTCDate(next.getUTCDate() + 1);
    while (!config.trading.days.includes(next.getUTCDay())) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }
  
  return new Date(next.getTime() - offset);
};

module.exports = {
  isTradingDay,
  isTradingHours,
  isTradingOpen,
  getBangladeshTime,
  getBangladeshDate,
};