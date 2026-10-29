// Find title input using HTML id
// Stores reference to the element in variable "noteTitle"
const noteTitle = document.querySelector("#note-title");


// Print the input element in dev tools console
console.log(noteTitle);


// Find the notes section
const notesSection = document.querySelector("#notes");


// Makes the notes section visible
notesSection.hidden = false;


// Print the text currently inside the title input
// Typically empty; runs when script loads
console.log(noteTitle.value);

// Listen for typed changes in title
noteTitle.addEventListener("input", () -> { //<- THIS IS THE FUNCTION START

    // this function runs when input event occurs
    // reads and print the fields updated text
    console.log(noteTitle.value); 

});


