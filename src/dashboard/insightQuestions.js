// Retrieval questions contain only the analysis request. Presentation instructions
// belong in answerPrompt.js so metric/record keywords cannot redirect retrieval.
export const dashboardInsightMode = 'period-insights-v4';
const questions = {
 overview: 'מהם הנושאים הבולטים בפרויקט בתקופה ומה משמעותם הניהולית?',
 risks: 'מהו מוקד הסיכון המרכזי בפרויקט בתקופה ומהן השלכותיו? נתח חסמים, בטיחות ולוח זמנים על בסיס מקורות הפרויקט.',
 actions: 'מהי העדיפות הניהולית המרכזית בפרויקט בתקופה, ומה במקורות מצדיק אותה?'
};
export function dashboardInsightQuestion(section, {dateFrom, dateTo} = {}) {
 if (!questions[section]) throw new Error('Unknown dashboard insight section');
 return `${questions[section]} טווח הניתוח: ${dateFrom || 'תחילת הפרויקט'} עד ${dateTo || 'היום'}.`;
}
