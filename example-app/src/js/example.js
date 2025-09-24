import { CapacitorPosthog } from 'capacitor-posthog';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    CapacitorPosthog.echo({ value: inputValue })
}
