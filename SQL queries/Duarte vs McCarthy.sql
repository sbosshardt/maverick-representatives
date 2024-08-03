SELECT
  l.legislator_name,
  r.rollcall_num,
  r.legis_num,
  r.vote_question,
  t.yea,
  t.nay,
  v.vote
FROM
  roll_calls r,
  legislators l,
  totals t,
  votes v
WHERE
  t.roll_call_id = r.id AND
  v.roll_call_id = r.id AND
  l.id = v.legislator_id AND
  l.legislator_name = 'Duarte' AND
  t.party = 'Republican' AND
(
  (t.yea > t.nay AND (v.vote = 'No' or v.vote = 'Nay')) OR
  (t.yea < t.nay AND (v.vote = 'Yea' OR v.vote = 'Aye'))
)