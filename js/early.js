/* Runs before first paint: lets CSS know scripts are available, so
   reveal-on-scroll hides content only when it can also show it. */
document.documentElement.classList.add("js");
