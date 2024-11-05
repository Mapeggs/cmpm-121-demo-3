// todo

// Function to create a button and append it to the document body
function createAlertButton(): void {
  const button = document.createElement("button");

  button.textContent = "Click Me!";

  button.addEventListener("click", () => {
    alert("You clicked the button!");
  });

  document.body.appendChild(button);
}

createAlertButton();
