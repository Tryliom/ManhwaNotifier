export class LoadTime
{
    /** @type {number} */
    TotalTime = 0
    /** @type {number} */
    Total = 0
    /** @type {number} */
    ShortestTime = 1000000
    /** @type {number} */
    LongestTime = 0

    AddTime(time)
    {
        this.TotalTime += time;
        this.Total++;

        if (time < this.ShortestTime)
        {
            this.ShortestTime = time
        }

        if (time > this.LongestTime)
        {
            this.LongestTime = time
        }
    }
}