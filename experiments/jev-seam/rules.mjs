export const localRules = Object.freeze({
  id: 'ivory-j1-rules', version: '0.1.0', remote: false,
  evaluate(context, question) {
    const id = question.id.startsWith('candidate:') ? question.id.slice('candidate:'.length) : '';
    const candidate = context.records.find(record => record.kind === 'Candidate' && record.ref.objectId === id);
    const choice = candidate?.metadataCategory === 'in-scope' ? 'review'
      : candidate?.metadataCategory === 'out-of-scope' ? 'exclude' : 'abstain';
    return {
      questionId: question.id,
      probabilities: Object.fromEntries(question.options.map(option => [option, Number(option === choice)]))
    };
  }
});
