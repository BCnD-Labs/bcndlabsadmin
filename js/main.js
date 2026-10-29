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
noteTitle.addEventListener("input", () => { //<- THIS IS THE FUNCTION START

    // this function runs when input event occurs
    // reads and print the fields updated text
    console.log(noteTitle.value); 

});


// FIND FORM AND NOTES CONTENT
const noteForm = document.querySelector("#note-form");
const noteBody = document.querySelector("#note-body");

// FIND WHERE NOTES WILL APPEAR
const noteList = document.querySelector("#note-list");
const notesEmpty = document.querySelector("#notes-empty");

// Find the area where notifications will appear.
const toastRegion = document.querySelector("#toast-region");

// Remember the timer so we can cancel it when another message appears.
let toastTimer;

// Define a reusable function that displays a message.
function showToast(message) {

    // Cancel the previous notification's timer.
    clearTimeout(toastTimer);

    // Create the notification and set its text.
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    // Replace any previous notification with this one.
    toastRegion.replaceChildren(toast);

    // Remove this notification after 4,000 milliseconds (4 seconds).
    toastTimer = setTimeout(() => {

    toast.remove();

    }, 4000);
}


// LISTEN FOR FORM SUBMISSION
noteForm.addEventListener("submit", (event) => {

    // STOP DEFAULT BROWSER FORM SUBMIT; PREVENTS PAGE RELOAD
    event.preventDefault();

    // READ BOTH FIELDS AND REMOVE WHITE SPACE
    const title = noteTitle.value.trim();
    const body = noteBody.value.trim();

    // PRINT CAPTURED TEXT IN DEV TOOLS
    console.log("Title:", title);
    console.log("Body", body);

    // REJECT ENTRIES WITH ONLY SPACES
    if (!title || !body) {
        return;

    }

    // CREATE LIST TO HOLD NOTE
    const item = document.createElement("li");
    item.className = "list-item";

    // CREATE HEADING
    const heading = document.createElement("h3");
    heading.textContent = title;

    // CREATE PARAGRAPH
    const text = document.createElement("p");
    text.className = "note-body";
    text.textContent = body;

    // PUT HEADING + PARAGRAPH INTO A LIST
    item.append(heading, text);

    // COMPLETED ITEM AT BEGINNING OF NOTES
    noteList.prepend(item);

    // HIDE EMPTY-STATE MESSAGE
    notesEmpty.hidden = true;

    // CLEAR FORM; CURSOR BACK IN TITLE FIELD
    noteForm.reset();
    noteTitle.focus();

    // SHOW TOAST NOTIFICATION
    showToast("Note added for this session.");







});


