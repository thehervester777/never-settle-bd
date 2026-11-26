import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizeHtml } from '../../src/lib/sanitize-html.ts';

test('keeps the simple formatting the admin may use', () => {
  const html = '<p>Soft <strong>cotton</strong> and <em>linen</em>.</p><ul><li>Machine wash</li></ul><h3>Fit</h3><p>Line<br>break</p>';
  assert.equal(sanitizeHtml(html), html);
});

test('removes scripts, event handlers, styles and frames', () => {
  const out = sanitizeHtml('<p onclick="alert(1)" style="color:red">Hi</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><img src=x onerror=alert(1)><svg><script>alert(1)</script></svg>');
  assert.equal(out, '<p>Hi</p>');
  for (const bad of ['<script', 'onerror', 'onclick', 'iframe', 'style=', '<img', '<svg']) assert.ok(!out.toLowerCase().includes(bad), bad);
});

test('links: only safe addresses, external ones open safely', () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href=" jav&#x09;ascript:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href="data:text/html,hi">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href="//evil.test">x</a>'), '<a>x</a>');
  assert.equal(sanitizeHtml('<a href="/size-guide">x</a>'), '<a href="/size-guide">x</a>');
  assert.equal(sanitizeHtml('<a href="https://example.com/a?b=1&amp;c=2">x</a>'), '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">x</a>');
  assert.ok(!sanitizeHtml('<a href="https://x.test" onmouseover="alert(1)">x</a>').includes('onmouseover'));
});

test('broken or sneaky markup can not produce a tag', () => {
  for (const input of ['<scr<script>ipt>alert(1)</script>', '<<p>p onclick=alert(1)>', '<p title="a>b" onclick="x">t</p>', '<!--<script>-->alert(1)', '<p>unclosed', '</li></ul>text']) {
    const out = sanitizeHtml(input);
    assert.ok(!/<(?!\/?(p|br|strong|b|em|i|u|s|ul|ol|li|h2|h3|h4|blockquote|a|hr|small|span)\b)/i.test(out), `${input} → ${out}`);
    assert.ok(!/on\w+\s*=/.test(out.replace(/&[a-z]+;/g, '')) || out.includes('&lt;'), `${input} → ${out}`);
  }
  assert.equal(sanitizeHtml('<p>unclosed'), '<p>unclosed</p>');
});

test('plain text becomes paragraphs, and is escaped', () => {
  assert.equal(sanitizeHtml('First line\nsecond\n\nNew para & more'), '<p>First line<br>second</p><p>New para &amp; more</p>');
  assert.equal(sanitizeHtml('5 < 6 > 4'), '<p>5 &lt; 6 &gt; 4</p>');
  assert.equal(sanitizeHtml(''), '');
  assert.equal(sanitizeHtml(null), '');
});

test('entities the writer typed are kept', () => {
  assert.equal(sanitizeHtml('<p>Tom &amp; Jerry &nbsp;&#8211; ok</p>'), '<p>Tom &amp; Jerry &nbsp;&#8211; ok</p>');
});

test('escapeHtml escapes every special character', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
