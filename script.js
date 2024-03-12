const rankList = document.getElementById('rank-list');
// Transmission Parameters
const numPacketsInput = document.getElementById('num-packets');
const addPacketBtn = document.getElementById('add-packets');
const removePacketBtn = document.getElementById('remove-packets');
let numPackets = 0; numPacketsInput.value = numPackets;

const speedInput = document.getElementById('tran-speed');
const increaseSpeedBtn = document.getElementById('increase-speed');
const decreaseSpeedBtn = document.getElementById('decrease-speed');
let speed = speedInput.value;

const startBtn = document.getElementById('start-btn');

// Data Transmission
const transmission = document.getElementById('trasmission-box'); // SVG Element
const senderLine = document.getElementById('sender-line');
const reciverLine = document.getElementById('reciver-line');
const propagationLine = document.getElementById('propagation-line');

let finishedCount = 0;
let dataPackets = []; // Declare dataPackets variable globally
let senderDataPackets = []; // Sender copy
let reciverACKPackets = []; // Sender copy

let isTransmiting = false;
let isTOT = false;

let abortController = null;

function createRecivedACKPacket(i, width, color, type) {
    let row = 0, col = 0, x, y, pktTpe = type == 0 ? 'recived' : 'ack';
    // console.log("here recived" + i);
    const dataPacket = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    dataPacket.classList.add(`${pktTpe}-packet`);
    dataPacket.setAttribute('id', `${pktTpe}Packet${i + 1}`);
    row = i % 3;
    if (i > 2) col = Math.floor(i / 3);
    x = 920 - row * 60;
    y = 80 + col * 40;
    dataPacket.setAttribute('x', `${x}`);
    dataPacket.setAttribute('y', `${y}`);
    dataPacket.setAttribute('width', `${width}`)
    dataPacket.setAttribute('height', '30')
    dataPacket.setAttribute('fill', `${color}`)
    dataPacket.setAttribute('data-name', `${pktTpe} Packet ${i + 1}`);
    transmission.appendChild(dataPacket);
    reciverACKPackets.push(dataPacket);
}

function sendPacket(packet, index) {
    const packetX = parseInt(packet.getAttribute('x'));
    const packetY = parseInt(packet.getAttribute('y'));
    const senderLineX = parseInt(senderLine.getAttribute('x'));
    const reciverLineX = parseInt(reciverLine.getAttribute('x'));
    const propLinex = parseInt(propagationLine.getAttribute('x'));
    const propLiney = parseInt(propagationLine.getAttribute('y'));

    let retryCount = 0;

    function transmit(deltaX, deltaY, speedBoost, signal) {
        return new Promise((resolve, reject) => {
            if (signal) {
                signal.addEventListener('abort', () => {
                    reject('Transmit aborted');
                });
            }
            // Calculate the duration of the transition based on speed
            const transitionDurationX = Math.abs(deltaX) / (speed * speedBoost);
            const transitionDurationY = Math.abs(deltaY) / (speed * speedBoost);
            // Apply the transition duration to the packet element
            packet.style.transitionDuration = `${Math.max(transitionDurationX, transitionDurationY)}s`; // Set the maximum duration
            // Move the packet using CSS transition
            packet.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            // Listen for the transitionend event
            packet.addEventListener('transitionend', () => {
                // console.log('Transmission animation complete');
                resolve(); // Resolve the promise after the animation is complete
            }, { once: true }); // Use { once: true } to ensure the event listener is called only once
        });
    }

    function propagate(deltaX, deltaY, speedBoost, signal) {
        return new Promise((resolve, reject) => {
            if (signal) {
                signal.addEventListener('abort', () => {
                    reject('Transmit aborted');
                });
            }
            // Calculate the duration of the transition based on speed
            let transitionDurationX = Math.abs(deltaX) / (speed * speedBoost);
            let transitionDurationY = Math.abs(deltaY) / (speed * speedBoost);
            // Apply the transition duration to the packet element
            packet.style.transitionDuration = `${Math.max(transitionDurationX, transitionDurationY)}s`; // Set the maximum duration
            // Move the packet using CSS transition
            packet.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            packet.addEventListener('transitionend', () => {
                transmit((deltaX + ((2 - (index % 3)) * 60) + 75), 0, 200).then(() => {
                    // console.log('Propagation animation complete');
                    resolve();
                });
            }, { once: true });

            // Simulate failure after 2 seconds
            setTimeout(() => {
                reject(`Propagation failed for packet ${packet}`);
            }, 12000);
        });
    }

    function ack(signal) {
        return new Promise((resolve, reject) => {
            if (signal) {
                signal.addEventListener('abort', () => {
                    reject('Transmit aborted');
                });
            }
            createRecivedACKPacket(index, 50, '#00FF00', 0);
            // createRecivedACKPacket(index, 10, '#FFA500', 1);
            packet.classList.add('ack');
            // <rect class="ack-packet" id="ackPacket1" x="920" y="80" width="10" height="30" fill="#FFA500" data-name="ack Packet 1"></rect>
            transmit((reciverLineX - senderLineX + ((index % 3) * 60) + 45), propLiney - packetY, 200).then(() => {
                transmit(propLinex - packetX, propLiney - packetY, 30).then(() => {
                    packet.style.transform = `translate(0px, 0px)`;
                    setTimeout(() => {
                        // console.log('ACK Done');
                        packet.classList.remove('ack');
                        senderDataPackets[index].classList.remove('tot');
                        resolve();
                    }, 1000);
                }, { once: true });
            }, { once: true });
            // resolve(); 
            // Simulate failure after 1 second
            setTimeout(() => {
                reject(`Acknowledgement failed for packet ${index}`);
            }, 5000);
        });
    }

    async function attemptSending(signal) {
        senderDataPackets[index].classList.add('tot');
        try {
            await transmit(propLinex - packetX, propLiney - packetY, 30, signal); // Pass the signal to transmit function
            await propagate((reciverLineX - senderLineX + ((index % 3) * 60)), (propLiney - packetY), 60, signal); // Pass the signal to propagate function
            return await ack(signal); // Pass the signal to ack function
        } catch (error) {
            throw error; // Propagate the error up the chain
        }
    }

    function timeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                isTOT = true;
                reject('Timeout reached');
            }, 15000); // 15 seconds timeout
        });
    }

    function attemptProcessing() {
        return new Promise((resolve, reject) => {
            isTOT = false;
            abortController = new AbortController();
            const signal = abortController.signal;

            const sendingPromise = attemptSending(signal);
            const timeoutPromiseInstance = timeoutPromise(); // Store the timeout promise instance
            Promise.race([sendingPromise, timeoutPromiseInstance])
                .then(() => {
                    if (!isTOT) {
                        resolve('Processing completed successfully');
                    } else {
                        reject('Timeout reached');
                    }
                })
                .catch((error) => {
                    if (error === 'Timeout reached') {
                        retryCount++;
                        // console.log("Retrying : " + retryCount);
                        if (retryCount > 5) {
                            packet.style.transitionDuration = `0s`;
                            packet.style.transform = `translate(0px, 0px)`;
                            senderDataPackets[index].classList.remove('tot');
                            // console.log("made translate none");
                            setTimeout(() => {
                                abortController.abort();
                                reject(`Exceeded maximum retry limit for packet ${packet}`);
                            }, 2000);
                        } else {
                            packet.style.transitionDuration = `0s`;
                            packet.style.transform = `translate(0px, 0px)`;
                            senderDataPackets[index].classList.remove('tot');
                            // console.log("made translate none");
                            setTimeout(() => {
                                abortController.abort();
                                attemptProcessing(); // Retry processing
                            }, 1500);
                        }
                    } else {
                        reject(error);
                    }
                });
        });
    }

    // Start processing the packet
    return attemptProcessing();
}

function sendData() {
    if (isTransmiting) return;
    isTransmiting = true;


    function clearReciverPackets() {
        reciverACKPackets.forEach(packet => {
            transmission.removeChild(packet);
        });
        reciverACKPackets = [];
    }
    clearReciverPackets();
    if (dataPackets.length === 0) alert("No data packets to send");
    let index = 0;

    function processNextPacket() {
        if (index < dataPackets.length) {
            const currentPacket = dataPackets[index];
            sendPacket(currentPacket, index)
                .then((result) => {
                    // Processing for the current packet is successful
                    // console.log(result);
                    index++;
                    processNextPacket(); // Process the next packet
                })
                .catch((error) => {
                    // Handle errors gracefully
                    console.error(`Error processing packet ${index}: ${error}`);
                    index++; // Move to the next packet
                    processNextPacket(); // Process the next packet
                });
        } else {
            // console.log('All packets Sent.');
            isTransmiting = false;
            setTimeout(() => {
                alert("Transmission Succesful");
            }, 1000);
        }
    }
    // Start processing the packets sequentially
    processNextPacket();

}

// Function to delete all data packets
function deleteDataPackets() {
    // Remove each data packet from the transmission container
    dataPackets.forEach(packet => {
        transmission.removeChild(packet);
    });
    dataPackets = [];
    senderDataPackets.forEach(packet => {
        transmission.removeChild(packet);
    });
    senderDataPackets = [];
    reciverACKPackets.forEach(packet => {
        transmission.removeChild(packet);
    });
    reciverACKPackets = [];
    isTransmiting = false;
}

// numPackets = 15;
function createDataPackets() {
    if (!dataPackets) deleteDataPackets();
    let row = 0, col = 0, x, y;
    for (let i = 0; i < numPackets; i++) {
        // Sender Image
        const senderPacket = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        senderPacket.classList.add('packet');
        senderPacket.setAttribute('id', `SenderPacket${i + 1}`);
        row = i % 3;
        if (i > 2) col = Math.floor(i / 3);
        x = 120 - row * 60;
        y = 80 + col * 40;
        senderPacket.setAttribute('x', `${x}`);
        senderPacket.setAttribute('y', `${y}`);
        senderPacket.setAttribute('width', '50')
        senderPacket.setAttribute('height', '30')
        senderPacket.setAttribute('data-name', `Sender Packet ${i + 1}`);
        transmission.appendChild(senderPacket);
        senderDataPackets.push(senderPacket); // Push each raceBox to the raceBoxes array

        // To Transmit
        const dataPacket = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        dataPacket.classList.add('packet');
        dataPacket.setAttribute('id', `packet${i + 1}`);
        dataPacket.setAttribute('x', `${x}`);
        dataPacket.setAttribute('y', `${y}`);
        dataPacket.setAttribute('width', '50')
        dataPacket.setAttribute('height', '30')
        dataPacket.setAttribute('data-name', `Packet ${i + 1}`);
        transmission.appendChild(dataPacket);
        dataPackets.push(dataPacket); // Push each raceBox to the raceBoxes array
    }
}

createDataPackets(); // Create initial race boxes

// Transmission Parameters

// Number of Packets
addPacketBtn.addEventListener('click', () => {
    if (numPackets < 15) {
        numPackets++;
        numPacketsInput.value = numPackets;
        deleteDataPackets();
        createDataPackets(); // Create additional race box
    }
});

removePacketBtn.addEventListener('click', () => {
    if (numPackets > 1) {
        deleteDataPackets();
        numPackets--;
        numPacketsInput.value = numPackets;
        createDataPackets(); // Create additional race box
    }
});

// Transmission Speed
increaseSpeedBtn.addEventListener('click', () => {
    if (speed < 10) {
        speed++;
        speedInput.value = speed;
        // console.log(speed);
    }
});

decreaseSpeedBtn.addEventListener('click', () => {
    if (speed > 1) {
        speed--;
        speedInput.value = speed;
        // console.log(speed);
    }
});


function restartRace() {
    // Remove existing race boxes
    raceBoxes.forEach(box => box.remove());
    createRaceBoxes(); // Create new race boxes based on the updated number of players

    // Reset rank list
    rankList.innerHTML = '';

    // Reset finished count
    finishedCount = 0;

    // Start race
    requestAnimationFrame(moveBoxes);
    startBtn.textContent = "Restart Race";
}

// Event listener for start/restart button
startBtn.addEventListener('click', sendData);
