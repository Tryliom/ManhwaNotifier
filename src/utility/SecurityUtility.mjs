export class SecurityUtility
{
    static IsCreator(userID)
    {
        return userID === process.env.creatorId;
    }
}