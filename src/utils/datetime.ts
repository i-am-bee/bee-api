import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

export const getLatestDailyFixedTime = () => {
  const fixedTimeToday = dayjs.utc().tz('America/New_York').hour(0).minute(0).second(0);
  // time shift might have been in either direction
  return fixedTimeToday.isAfter(dayjs()) ? fixedTimeToday.subtract(1, 'day') : fixedTimeToday;
};
