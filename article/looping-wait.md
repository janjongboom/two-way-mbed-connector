# A disco effect: Looping and wait() in mbed OS

Let's say I have a tri-color LED and want to make a small disco effect, by toggling the three channels every few hundred milliseconds, and then stop after 10 iterations.

<video autoplay="true" controls="false" loop="true">
    <source src="assets/disco.mp4" type="video/mp4">
</video>

Easy enough when doing traditional embedded development.

```cpp
static DigitalOut red(D5);
static DigitalOut green(D6);
static DigitalOut blue(D7);

int main() {
    for (int i = 0; i < 60; i++) {
        red   = (i % 6 == 0 || i % 6 == 1 || i % 6 == 2);
        green = (i % 6 == 2 || i % 6 == 3 || i % 6 == 4);
        blue  = (i % 6 == 4 || i % 6 == 5 || i % 6 == 0);
        wait(0.2);
    }
    // rest of your program
}
```

In [mbed OS](https://www.mbed.com/en/development/software/mbed-os/) (the OS formerly known as mbed v3.0), the approach above is not allowed:

* It blocks main, which is bad, because no other operations can happen at this point.
* The microcontroller needs to be awake, to honor the `wait` call and thus cannot go into deep sleep in between.

mbed OS works with an [event loop](https://docs.mbed.com/docs/getting-started-mbed-os/en/latest/Full_Guide/MINAR/), similar to node.js or Ruby's EventMachine. So instead of blocking the microcontroller, we rather tell the OS: "hey! in 200 milliseconds I'd like to do something again, can you wake me up?". That means that we need to rewrite this code a bit, and use events, rather than a blocking `wait()` call.

```cpp
static DigitalOut red(D5);
static DigitalOut green(D6);
static DigitalOut blue(D7);

// [1]
void disco(int8_t times_left, int16_t delay) {
    if (turns_left > 0) {
        // [2]
        FunctionPointer2<void, int8_t, int16_t> fp(&disco);
        // [3]
        minar::Scheduler::postCallback(fp.bind(turns_left - 1, delay_ms))
            // [4]
            .delay(minar::milliseconds(delay_ms));
    }

    red   = turns_left % 6 == 0 || turns_left % 6 == 1 || turns_left % 6 == 2;
    green = turns_left % 6 == 2 || turns_left % 6 == 3 || turns_left % 6 == 4;
    blue  = turns_left % 6 == 4 || turns_left % 6 == 5 || turns_left % 6 == 0;
}

void app_start(int argc, char *argv[]) {
    // [5]
    disco(60, 200);
}
```

We use a similar approach as you'd use when doing `setTimeout` in JavaScript:

1. We create a function `disco` that takes two arguments, one is the number of times it should run after the current iteration. And two, the delay until the next iteration. This function will be invoked every 200 ms.
2. If we have turns left, we create a [FunctionPointer](https://docs.mbed.com/docs/getting-started-mbed-os/en/latest/Full_Guide/MINAR/#function-pointers-and-binding-in-minar).
    * It's return type is `void` and it takes an `int8_t` and an `int16_t` as arguments.
    * Surprise, this is the same function signature as our current function.
    * We initialize the function pointer with a reference to the `disco` function.
3. We tell minar (the event scheduler), that we want to execute the function pointer, with the arguments `turns_left - 1`, and our `delay_ms`.
4. We also tell minar that we want to wait `delay_ms` before the function is called.
5. And when our application starts we kick off the sequence.

Relatively easy, and now our code is non-blocking!

## Calling a member function

If `disco` would have been a class member, we can also use the `FunctionPointer`, just pass in the object reference as the first argument.

```cpp
class DiscoClass {
    void disco(int8_t times_left, int16_t delay) {
        if (turns_left > 0) {
            // HERE!
            FunctionPointer2<void, int8_t, int16_t> fp(this, &DiscoClass::disco);

        // ... rest of the function
    }
```
