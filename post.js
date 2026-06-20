const params = new URLSearchParams(location.hash.slice(1));
const action = params.get("action");
if (action) {
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
}
