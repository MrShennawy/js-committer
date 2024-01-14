class RequiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "Required";
    }
}

export default RequiredError;