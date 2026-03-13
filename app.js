
document.addEventListener("DOMContentLoaded", () => {

  const tg = window.Telegram.WebApp;

  // Telegram WebApp initialize
  tg.ready();

  // Expand app
  tg.expand();

  const helloBtn = document.getElementById("hello-btn");

  helloBtn.addEventListener("click", () => {
    alert("Hello from Mini App");
  });

});