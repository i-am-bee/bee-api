/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
