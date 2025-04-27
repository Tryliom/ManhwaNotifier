function PadTo2Digits(num) {
    return num.toString().padStart(2, '0');
}

export class StringUtility
{
    static CutText(text, maxLength)
    {
        if (text.length > maxLength) return text.substring(0, maxLength - 3) + "...";
        return text;
    }

    static FormatDate(date)
    {
        return `${
            [
                date.getFullYear(),
                PadTo2Digits(date.getMonth() + 1),
                PadTo2Digits(date.getDate()),
            ].join('-')
        } ${PadTo2Digits(date.getHours())}h ${PadTo2Digits(date.getMinutes())}min`;
    }

    /**
     * Get all complete numbers in a string and return them in an array; numbers need to be separated by: /, space, -, .
     * @param str {string} - The string to extract the numbers from
     * @returns {number[]} - The array of numbers found in the string
     */
    static GetAllNumbersInString(str)
    {
        // Numbers need to be separated by: /, space, -, . and not a character
        const authorizedNumber = /[0-9]/;
        const authorizedSeparator = /[\/\s.\-]/;

        let numbers = [];
        let lastCharacterWasSeparator = true;
        let currentNumber = "";

        for (let i = 0; i < str.length; i++)
        {
            if (authorizedNumber.test(str[i]) && lastCharacterWasSeparator)
            {
                currentNumber += str[i];
            }
            else if (currentNumber.length > 0)
            {
                lastCharacterWasSeparator = authorizedSeparator.test(str[i]);
                if (lastCharacterWasSeparator) numbers.push(parseInt(currentNumber));
                currentNumber = "";
            }
            else if (currentNumber.length === 0)
            {
                lastCharacterWasSeparator = authorizedSeparator.test(str[i]);
            }
        }

        if (currentNumber.length > 0)
        {
            numbers.push(parseInt(currentNumber));
        }

        return numbers.reverse();
    }

    static GetRandomString(length)
    {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < length; i++)
        {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        return result;
    }
}