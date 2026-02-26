const ical = require('node-ical');

async function test() {
    const events = await ical.async.fromURL('https://canvas.instructure.com/feeds/calendars/user_fAke123CalendarLink321.ics');
    console.log("SUCCESS")
}
test();
