export let availableStatuses = [];
export let availableEmployees = [];
export function setInitialData(data) {
    availableStatuses = data.statuses || [];
    availableEmployees = data.employees || [];
}