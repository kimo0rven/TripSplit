export function dateToday() {
        return new Date()
            .toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            })
            .toUpperCase();
    }

export function timeOfTheDay() {
        const hours = new Date().getHours();

        if (hours >= 5 && hours < 12) return "Good Morning";
        if (hours >= 12 && hours < 17) return "Good Afternoon";
        if (hours >= 17 && hours < 22) return "Good Evening";
        return "Good Night";
    }

// export function formatDate() {

// }
