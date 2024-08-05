SELECT
  l.legislator_name,
  r.rollcall_num,
  r.session,
  r.legis_num,
  r.vote_question,
  r.vote_desc,
  r.amendment_num,
  r.amendment_author,
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
) AND
(t.yea < 25 OR t.nay < 25)
GROUP BY legis_num
ORDER BY yea DESC
