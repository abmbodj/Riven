export const CLASS_TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
export const CLASS_TIME_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
export const CLASS_TIME_MERIDIEM_OPTIONS = ['AM', 'PM'];

export const DEFAULT_CLASS_START_TIME = '09:00';
export const DEFAULT_CLASS_END_TIME = '10:00';

export function buildDefaultClassTimeRow() {
    return { day: '', start_time: DEFAULT_CLASS_START_TIME, end_time: DEFAULT_CLASS_END_TIME, id: null };
}

export function toTwelveHourParts(time24) {
    if (!time24 || !/^\d{2}:\d{2}$/.test(time24)) {
        return { hour: '9', minute: '00', meridiem: 'AM' };
    }

    const [rawHours, minute] = time24.split(':');
    const hours = Number(rawHours);
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const normalizedHour = hours % 12 || 12;

    return {
        hour: String(normalizedHour),
        minute,
        meridiem,
    };
}

export function toTwentyFourHourTime(parts) {
    const hour = Number(parts?.hour);
    const minute = String(parts?.minute ?? '').padStart(2, '0');
    const meridiem = parts?.meridiem;

    if (!hour || !minute || !CLASS_TIME_MERIDIEM_OPTIONS.includes(meridiem)) {
        return '';
    }

    let normalizedHour = hour % 12;
    if (meridiem === 'PM') normalizedHour += 12;

    return `${String(normalizedHour).padStart(2, '0')}:${minute}`;
}

export function isValidTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return false;
    return startTime < endTime;
}
