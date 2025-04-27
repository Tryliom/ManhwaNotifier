import {EmbedUtility} from "../../utility/EmbedUtility.mjs";

export class Faq
{
    /** @type {string} */
    Question = ""
    /** @type {string} */
    Answer = ""

    constructor()
    {
        this.Question = "";
        this.Answer = "";
    }

    FromJson(data)
    {
        this.Question = data.Question;
        this.Answer = data.Answer;

        return this;
    }

    ToEmbed()
    {
        return EmbedUtility.GetNeutralEmbedMessage(this.Question, this.Answer);
    }
}