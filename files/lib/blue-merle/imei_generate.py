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


def calculate_check_digit(base_imei):
    """Calculate Luhn check digit for 14-digit base IMEI"""
    iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(base_imei)])
    sum_digits = reduce((lambda a, b: int(a) + int(b)), iteration_1)
    return (10 - int(str(sum_digits)[-1])) % 10


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
    validation_digit = calculate_check_digit(imei)
    if (verbose):
        print(f"Validation digit: {validation_digit}")

    imei = str(imei) + str(validation_digit)
    if (verbose):
        print(f"Resulting IMEI: {imei}")

    return imei


def validate_and_correct_imei(imei):
    """Validate 15-digit IMEI and auto-correct check digit if needed"""
    # Check if length is 15 characters (14 digits + 1 check digit)
    if len(imei) != 15:
        print(f"NOT A VALID IMEI: {imei} - IMEI must be exactly 15 digits")
        return None
    
    # Check if all characters are digits
    if not imei.isdigit():
        print(f"NOT A VALID IMEI: {imei} - IMEI must contain only digits")
        return None
    
    # Extract base IMEI and check digit
    base_imei = imei[:14]
    input_check_digit = int(imei[14])
    correct_check_digit = calculate_check_digit(base_imei)
    
    if input_check_digit == correct_check_digit:
        # IMEI is correct
        if (verbose):
            print(f"IMEI {imei} is VALID")
        return imei
    else:
        # Auto-correct the check digit
        corrected_imei = base_imei + str(correct_check_digit)
        if (verbose):
            print(f"CHECK DIGIT CORRECTED:")
            print(f"  Input:   {imei} (check digit: {input_check_digit})")
            print(f"  Correct: {corrected_imei} (check digit: {correct_check_digit})")
            print(f"  Using corrected IMEI")
        else:
            print(f"IMEI check digit corrected from {input_check_digit} to {correct_check_digit}")
        
        return corrected_imei


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
        # Handle both 14-digit and 15-digit IMEIs with smart correction
        if len(static_imei) == 14:
            # 14-digit IMEI - basic format validation only
            if not static_imei.isdigit():
                print(f"NOT A VALID IMEI: {static_imei} - IMEI must contain only digits")
                exit(-1)
            
            if (verbose):
                print(f"Using 14-digit IMEI: {static_imei}")
                # Show what the complete IMEI would be (informational only)
                calculated_check_digit = calculate_check_digit(static_imei)
                print(f"Complete IMEI would be: {static_imei}{calculated_check_digit}")
            
            if not args.generate_only:
                if not set_imei(static_imei):
                    exit(-1)
                    
        elif len(static_imei) == 15:
            # 15-digit IMEI - validate and auto-correct if needed
            corrected_imei = validate_and_correct_imei(static_imei)
            if corrected_imei is None:
                exit(-1)
            
            if not args.generate_only:
                if not set_imei(corrected_imei):
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