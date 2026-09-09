const params = new URLSearchParams(location.hash.slice(1));
const action = params.get("action");
let allowed = false;
try { allowed = ['http:', 'https:'].includes(new URL(action).protocol); } catch {}
if (allowed) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [key, value] of params) {
    if (key === "action") continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
} else {
  document.body.textContent = 'Search could not open. The form action must be an HTTP or HTTPS URL.';
}
