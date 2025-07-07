#!/usr/bin/env python3
import random
import string
import argparse
import serial
import re
from functools import reduce
from enum import Enum


class Modes(Enum):
    DETERMINISTIC = 1
    RANDOM = 2
    STATIC = 3


ap = argparse.ArgumentParser()
ap.add_argument("-v", "--verbose", help="Enables verbose output",
                action="store_true")
ap.add_argument("-g", "--generate-only", help="Only generates an IMEI rather than setting it",
                   action="store_true")
modes = ap.add_mutually_exclusive_group()
modes.add_argument("-d", "--deterministic", help="Switches IMEI generation to deterministic mode", action="store_true")
modes.add_argument("-s", "--static", help="Sets user-defined IMEI",
                   action="store")
modes.add_argument("-r", "--random", help="Sets random IMEI",
                   action="store_true")

# Example IMEI: 490154203237518
imei_length = 14  # without validation digit
imei_prefix = ["35674108", "35290611", "35397710", "35323210", "35384110",
               "35982748", "35672011", "35759049", "35266891", "35407115",
               "35538025", "35480910", "35324590", "35901183", "35139729",
               "35479164"]

verbose = False
mode = None

# Serial global vars
TTY = '/dev/ttyUSB3'
BAUDRATE = 9600
TIMEOUT = 3


def get_imsi():
    if (verbose):
        print(f'Obtaining Serial {TTY} with timeout {TIMEOUT}...')
    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        if (verbose):
            print('Getting IMSI')
        ser.write(b'AT+CIMI\r')
        # TODO: read loop until we have 'enough' of what to expect
        output = ser.read(64)

    if (verbose):
        print(b'Output of AT+CIMI (Retrieve IMSI) command: ' + output)
        print('Output is of type: ' + str(type(output)))
    imsi_d = re.findall(b'[0-9]{15}', output)
    if (verbose):
        print("TEST: Read IMSI is", imsi_d)

    return b"".join(imsi_d)


def set_imei(imei):
    # The AT command expects 14 digits (without check digit)
    # but our validation works with 15 digits
    if len(imei) == 15:
        # Remove the check digit for the AT command
        imei_for_at_command = imei[:14]
    elif len(imei) == 14:
        # Already 14 digits, use as-is (backward compatibility)
        imei_for_at_command = imei
    else:
        print(f"IMEI is {len(imei)} characters long, expected 14 or 15")
        return False

    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        cmd = b'AT+EGMR=1,7,\"'+imei_for_at_command.encode()+b'\"\r'
        ser.write(cmd)
        output = ser.read(64)

    if (verbose):
        print(cmd)
        print(b'Output of AT+EGMR (Set IMEI) command: ' + output)
        print('Output is of type: ' + str(type(output)))

    new_imei = get_imei()
    if (verbose):
        print(b"New IMEI: "+new_imei+b" Sent: "+imei_for_at_command.encode())

    # The modem returns 15 digits (14 + its own check digit)
    # We need to compare just the first 14 digits
    if len(new_imei) >= 14 and new_imei[:14] == imei_for_at_command.encode():
        print("IMEI has been successfully changed.")
        return True
    else:
        print("IMEI has not been successfully changed.")
        if (verbose):
            print(f"Expected first 14 digits: {imei_for_at_command}")
            if len(new_imei) >= 14:
                print(f"Got first 14 digits: {new_imei[:14].decode()}")
        return False


def get_imei():
    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        ser.write(b'AT+GSN\r')
        output = ser.read(64)

    if (verbose):
        print(b'Output of AT+GSN (Retrieve IMEI) command: ' + output)
        print('Output is of type: ' + str(type(output)))
    imei_d = re.findall(b'[0-9]{15}', output)
    if (verbose):
        print("TEST: Read IMEI is", imei_d)

    return b"".join(imei_d)


def generate_imei(imei_prefix, imsi_d):
    # In deterministic mode we seed the RNG with the IMSI.
    # As a consequence we will always generate the same IMEI for a given IMSI
    if (mode == Modes.DETERMINISTIC):
        random.seed(imsi_d)

    # We choose a random prefix from the predefined list.
    # Then we fill the rest with random characters
    imei = random.choice(imei_prefix)
    if (verbose):
        print(f"IMEI prefix: {imei}")
    random_part_length = imei_length - len(imei)
    if (verbose):
        print(f"Length of the random IMEI part: {random_part_length}")
    imei += "".join(random.sample(string.digits, random_part_length))
    if (verbose):
        print(f"IMEI without validation digit: {imei}")

    # calculate validation digit
    # Double each second digit in the IMEI: 4 18 0 2 5 8 2 0 3 4 3 14 5 2
    # (excluding the validation digit)

    iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(imei)])

    # Separate this number into single digits: 4 1 8 0 2 5 8 2 0 3 4 3 1 4 5 2
    # (notice that 18 and 14 have been split).
    # Add up all the numbers: 4+1+8+0+2+5+8+2+0+3+4+3+1+4+5+2 = 52

    sum_digits = reduce((lambda a, b: int(a) + int(b)), iteration_1)

    # Take your resulting number, remember it, and round it up to the nearest
    # multiple of ten: 60.
    # Subtract your original number from the rounded-up number: 60 - 52 = 8.

    validation_digit = (10 - int(str(sum_digits)[-1])) % 10
    if (verbose):
        print(f"Validation digit: {validation_digit}")

    imei = str(imei) + str(validation_digit)
    if (verbose):
        print(f"Resulting IMEI: {imei}")

    return imei


def validate_imei(imei):
    # Check if length is 15 characters (14 digits + 1 check digit)
    if len(imei) != 15:
        print(f"NOT A VALID IMEI: {imei} - IMEI must be exactly 15 digits")
        return False
    
    # Check if all characters are digits
    if not imei.isdigit():
        print(f"NOT A VALID IMEI: {imei} - IMEI must contain only digits")
        return False
    
    # Extract the check digit (last digit)
    validation_digit = int(imei[-1])
    # Extract the first 14 digits for verification
    imei_verify = imei[0:14]
    
    if (verbose):
        print(f"Validating IMEI: {imei}")
        print(f"Check digit: {validation_digit}")
        print(f"Base digits: {imei_verify}")

    # Double each second digit in the IMEI (starting from position 0)
    iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(imei_verify)])

    # Separate this number into single digits and add them up
    sum_digits = reduce((lambda a, b: int(a) + int(b)), iteration_1)
    
    if (verbose):
        print(f"Doubled sequence: {iteration_1}")
        print(f"Sum: {sum_digits}")

    # Calculate expected check digit using Luhn algorithm
    validation_digit_verify = (10 - int(str(sum_digits)[-1])) % 10
    
    if (verbose):
        print(f"Expected check digit: {validation_digit_verify}")

    if validation_digit == validation_digit_verify:
        print(f"{imei} is VALID")
        return True

    print(f"NOT A VALID IMEI: {imei} - Check digit validation failed")
    print(f"Expected check digit: {validation_digit_verify}, got: {validation_digit}")
    return False


if __name__ == '__main__':
    args = ap.parse_args()
    imsi_d = None
    if args.verbose:
        verbose = args.verbose
    if args.deterministic:
        mode = Modes.DETERMINISTIC
        imsi_d = get_imsi()
    if args.random:
        mode = Modes.RANDOM
    if args.static is not None:
        mode = Modes.STATIC
        static_imei = args.static

    if mode == Modes.STATIC:
        # Handle both 14-digit and 15-digit IMEIs
        if len(static_imei) == 14:
            # 14-digit IMEI - basic format validation only
            if not static_imei.isdigit():
                print(f"NOT A VALID IMEI: {static_imei} - IMEI must contain only digits")
                exit(-1)
            
            if (verbose):
                print(f"Using 14-digit IMEI: {static_imei}")
                # Show what the complete IMEI would be (informational only)
                iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(static_imei)])
                sum_digits = reduce((lambda a, b: int(a) + int(b)), iteration_1)
                calculated_check_digit = (10 - int(str(sum_digits)[-1])) % 10
                print(f"Complete IMEI would be: {static_imei}{calculated_check_digit}")
            
            if not args.generate_only:
                if not set_imei(static_imei):
                    exit(-1)
                    
        elif len(static_imei) == 15:
            # 15-digit IMEI - full Luhn validation
            if validate_imei(static_imei):
                if not args.generate_only:
                    if not set_imei(static_imei):
                        exit(-1)
            else:
                exit(-1)
        else:
            print(f"NOT A VALID IMEI: {static_imei} - IMEI must be 14 or 15 digits")
            exit(-1)
    else:
        imei = generate_imei(imei_prefix, imsi_d)
        if (verbose):
            print(f"Generated new IMEI: {imei}")
        if not args.generate_only:
            if not set_imei(imei):
                exit(-1)

    exit(0)