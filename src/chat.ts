async function sendMessage(to: string, message: string) {
    const response = await fetch(
        `https://graph.facebook.com/v22.0/958901867299863/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer EAAeQJTyKTQ8BQaHjYnUTcBn082EeOBAysWisiAElsudSt1J3tqXS0y9Yalu6vSOgiAyfhHGkQDiua8vwEQzKYfswyhJFiApVHHgCsimnwah46ZBFJNBxOpKlyeih8sFGG3SKzGaKUQDmHbYzwTguWEgo2xSKwisynqJjThZCKEh4UDLh1tLnBdJNgVBnxpzJu4QJXkcihgZBP65uUkSSZBPG65EQ5OQ4hwiANwt2CmKkyYBnvhLySfVrvwVCmT4JUTPXZByqE3JZCMzvRUyo2q`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to,
                text: { body: message }
            })
        }
    );

    const data = await response.json();
    console.log(data);
}