export const generateICS = (schedule) => {
    const formatDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, "").split(".")[0] + "Z";
    };

    let icsLines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Emerald Explorer//Custody Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ];

    schedule.forEach((item, index) => {
        if (item.isParenting) {
            const start = new Date(item.date);
            start.setHours(8, 0, 0); // Default 8 AM swap
            const end = new Date(item.date);
            end.setHours(20, 0, 0); // Default 8 PM coverage

            icsLines.push("BEGIN:VEVENT");
            icsLines.push(`UID:custody-${index}@emeraldexplorer.com`);
            icsLines.push(`DTSTAMP:${formatDate(new Date())}`);
            icsLines.push(`DTSTART:${formatDate(start)}`);
            icsLines.push(`DTEND:${formatDate(end)}`);
            icsLines.push("SUMMARY:Parenting Time (Emerald Explorer)");
            icsLines.push("DESCRIPTION:Automatically generated custody schedule.");
            icsLines.push("END:VEVENT");
        }
    });

    icsLines.push("END:VCALENDAR");

    return icsLines.join("\r\n");
};

export const downloadICS = (content, filename = "custody-schedule.ics") => {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
