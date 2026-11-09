/** Only an allowlisted appearance identifier may be remembered. Runs before paint. */
(()=>{let theme='warm';try{if(localStorage.getItem('rental-appearance')==='sage')theme='sage';}catch{}document.documentElement.dataset.theme=theme;})();
